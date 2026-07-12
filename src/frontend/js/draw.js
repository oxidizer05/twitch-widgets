const createRealtimeClient = require("./incude/realtime");
const request = require("./incude/request");
const { timestamp } = require("@raz1el/util");

const headlineEl = document.querySelector("[data-role='headline']");
const statusEl = document.querySelector("[data-role='status']");
const descriptionEl = document.querySelector("[data-role='description']");
const countEl = document.querySelector("[data-role='count']");
const timerEl = document.querySelector("[data-role='timer']");
const commandEl = document.querySelector("[data-role='command']");
const winnerSection = document.querySelector("[data-role='winner']");
const winnerNameEl = document.querySelector("[data-role='winner-name']");

let countdownTimer;
let countdownEnd = 0;
let hasActiveDraw = false;
let isAwaitingWinner = false;

function setStatus(text) {
    if (statusEl)
        statusEl.textContent = text;
}

function setHeadline(text) {
    if (headlineEl)
        headlineEl.textContent = text;
}

function setDescription(text) {
    if (descriptionEl)
        descriptionEl.textContent = text;
}

function setCount(value) {
    if (countEl)
        countEl.textContent = String(value);
}

function setCommand(value) {
    if (commandEl)
        commandEl.textContent = value;
}

function updateTimer(seconds) {
    if (!timerEl)
        return;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    timerEl.textContent = `${formatNumber(mins)}:${formatNumber(secs)}`;
}

function formatNumber(value) {
    return value > 9 ? String(value) : `0${value}`;
}

function hideWinner() {
    if (winnerSection) {
        winnerSection.classList.add("hidden");
        if (winnerNameEl)
            winnerNameEl.textContent = "";
    }
}

function showWinner(name) {
    if (!winnerSection)
        return;
    winnerSection.classList.remove("hidden");
    if (winnerNameEl)
        winnerNameEl.textContent = name;
}

function stopCountdown() {
    if (countdownTimer)
        clearInterval(countdownTimer);
    countdownTimer = undefined;
}

function startCountdown(endTimestamp) {
    countdownEnd = endTimestamp;
    stopCountdown();

    const update = () => {
        const remaining = Math.max(0, countdownEnd - timestamp());
        updateTimer(remaining);

        if (remaining === 0) {
            stopCountdown();
            if (!isAwaitingWinner)
                requestWinner();
        }
    };

    update();
    countdownTimer = setInterval(update, 1000);
}

function renderIdle() {
    hasActiveDraw = false;
    stopCountdown();
    updateTimer(0);
    hideWinner();
    setHeadline("Подготовка к розыгрышу");
    setDescription("Стример ещё не запустил розыгрыш. Следите за чатом, чтобы не пропустить старт!");
    setCommand("!draw");
    setCount(0);
    setStatus("Ожидаем запуск");
    isAwaitingWinner = false;
}

function statusFromData(data) {
    if (!data)
        return "Ожидаем запуск";
    if (data.winnerSelected || (!isAwaitingWinner && data.endTimestamp && timestamp() >= data.endTimestamp))
        return "Розыгрыш завершён";
    if (isAwaitingWinner)
        return "Определяем победителя…";
    if (data.endTimestamp)
        return "Розыгрыш идёт";
    return "Ожидаем запуск";
}

function applyDrawData(data) {
    hasActiveDraw = true;
    setHeadline(data.text || "Розыгрыш сообщества");
    setDescription(`Напишите команду ${data.command} в чат Twitch, чтобы принять участие.`);
    setCommand(data.command);
    setCount(data.userCount);

    if (data.endTimestamp > timestamp())
        startCountdown(data.endTimestamp);
    else if (data.endTimestamp && !data.winnerSelected) {
        stopCountdown();
        updateTimer(0);
        if (!isAwaitingWinner)
            requestWinner();
    }
    else {
        stopCountdown();
        updateTimer(data.countdownSeconds);
    }

    if (data.winnerSelected)
        showWinner(data.lastWinner || "Участников не было");
    else
        hideWinner();

    if (data.winnerSelected)
        isAwaitingWinner = false;

    setStatus(statusFromData(data));
}

function requestWinner() {
    isAwaitingWinner = true;
    request("/api/draw/winner", (httpRequest) => {
        if (httpRequest.readyState !== 4)
            return;

        if (httpRequest.status !== 200)
            isAwaitingWinner = false;
    });
}

setStatus("Подключаемся…");
renderIdle();

createRealtimeClient({
    open: () => setStatus("В реальном времени"),
    close: () => {
        setStatus("Ожидаем подключение…");
        if (!hasActiveDraw)
            renderIdle();
    },
    init: (payload) => {
        if (!payload || !payload.draw) {
            renderIdle();
            return;
        }
        applyDrawData(payload.draw);
    },
    "draw:update": (data) => {
        if (!data)
            return;
        applyDrawData(data);
    },
    "draw:reset": () => {
        renderIdle();
    },
    "draw:winner": (payload) => {
        if (!payload || !payload.data)
            return;
        isAwaitingWinner = false;
        applyDrawData(payload.data);
        if (!payload.winner)
            showWinner("Участников не было");
    }
});
