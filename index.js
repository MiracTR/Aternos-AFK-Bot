"use strict";

const mineflayer = require("mineflayer");
const { pathfinder } = require("mineflayer-pathfinder");
const config = require("./settings.json");

// ==== BASİT LOG ====
function addLog(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// ==== STATE ====
let bot = null;
let isReconnecting = false;
let reconnectAttempts = 0;

// ==== INTERVAL MANAGER ====
let intervals = [];

function addInterval(fn, delay) {
    const id = setInterval(fn, delay);
    intervals.push(id);
}

function clearAllIntervals() {
    intervals.forEach(clearInterval);
    intervals = [];
}

// ==== RECONNECT ====
function getReconnectDelay() {
    const base = 3000;
    const max = 30000;
    const delay = Math.min(base * Math.pow(2, reconnectAttempts), max);
    return delay + Math.floor(Math.random() * 2000);
}

function scheduleReconnect() {
    if (isReconnecting) return;

    isReconnecting = true;
    reconnectAttempts++;

    const delay = getReconnectDelay();
    addLog(`Reconnecting in ${delay / 1000}s...`);

    setTimeout(() => {
        isReconnecting = false;
        createBot();
    }, delay);
}

// ==== BOT ====
function createBot() {

    if (bot) {
        try { bot.end(); } catch {}
        clearAllIntervals();
        bot = null;
    }

    addLog("Creating bot...");

    bot = mineflayer.createBot({
        host: config.server.ip,
        port: config.server.port,
        username: config["bot-account"].username,
        auth: config["bot-account"].type,
        version: false
    });

    bot.loadPlugin(pathfinder);

    // ================= SPAWN =================
    bot.once("spawn", () => {
        addLog("Spawned!");

        reconnectAttempts = 0;

        // 🏠 AFK'ya git
        setTimeout(() => {
            bot.chat("/spawn");
            addLog("→ /spawn");
        }, 3000);

        setTimeout(() => {
            bot.chat("/home afk");
            addLog("→ /home afk");
        }, 6000);

        // 🌊 AFK HAVUZU
        addInterval(() => {
            if (!bot.entity) return;

            if (bot.entity.isInWater || bot.entity.isInLava) {
                bot.setControlState("jump", true);
            } else {
                bot.setControlState("jump", false);
            }
        }, 200);

        // 🫁 BOĞULMA ENGELLEME
        addInterval(() => {
            if (!bot.entity || !bot.entity.isInWater) return;

            if (bot.oxygenLevel < 200) {
                bot.setControlState("jump", true);
            }
        }, 200);

        // 🧊 SUDA HAREKETİ DURDUR
        addInterval(() => {
            if (!bot.entity) return;

            if (bot.entity.isInWater) {
                bot.clearControlStates();
            }
        }, 500);

        // 📉 DÜŞME KORUMA
        addInterval(() => {
            if (!bot.entity || !bot.spawnPoint) return;

            if (bot.entity.position.y < bot.spawnPoint.y - 10) {
                addLog("Fall detected → /home afk");
                bot.chat("/home afk");
            }
        }, 5000);

        // 📶 PING
        addInterval(() => {
            if (bot.player) {
                addLog(`Ping: ${bot.player.ping}ms`);
            }
        }, 60000);

        // 💀 RESPAWN
        bot.on("death", () => {
            addLog("Died → respawn");
            setTimeout(() => {
                bot.chat("/spawn");
            }, 3000);
        });

        // 🌍 CHUNKS
        bot.waitForChunksToLoad().then(() => {
            addLog("Chunks loaded");
        });

        // 🧠 STUCK DETECT
        let lastMove = Date.now();

        bot.on("move", () => {
            lastMove = Date.now();
        });

        addInterval(() => {
            if (!bot.entity) return;

            if (!bot.entity.isInWater && Date.now() - lastMove > 300000) {
                addLog("Bot stuck → restarting");
                bot.end();
            }
        }, 60000);
    });

    // ================= KICK =================
    bot.on("kicked", (reason) => {
        const msg = typeof reason === "object" ? JSON.stringify(reason) : reason;
        const reasonStr = String(msg).toLowerCase();

        addLog(`Kicked: ${msg}`);

        // 🚀 SERVER FULL FIX
        if (/full|dolu|queue/i.test(reasonStr)) {
            addLog("Server full → waiting 30s...");
            isReconnecting = true;

            setTimeout(() => {
                isReconnecting = false;
                scheduleReconnect();
            }, 30000);

            return;
        }
    });

    // ================= END =================
    bot.on("end", () => {
        addLog("Disconnected");
        clearAllIntervals();
        scheduleReconnect();
    });

    // ================= ERROR =================
    bot.on("error", (err) => {
        addLog(`Error: ${err.message}`);
    });
}

// ==== START ====
createBot();
