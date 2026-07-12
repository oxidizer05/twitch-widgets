const createRealtimeClient = require("./incude/realtime");

const headlineEl = document.querySelector("[data-role='headline']");
const statusEl = document.querySelector("[data-role='status']");
const totalEl = document.querySelector("[data-role='total']");
const winnerEl = document.querySelector("[data-role='winner-message']");

const options = {
    a: getOptionElements("a"),
    b: getOptionElements("b")
};

let hasActiveVote = false;

function getOptionElements(id) {
    const root = document.querySelector(`[data-option='${id}']`);
    if (!root)
        return {};
    return {
        root,
        bar: root.querySelector("[data-role='bar']"),
        percent: root.querySelector("[data-role='percent']"),
        count: root.querySelector("[data-role='count']"),
        command: root.querySelector("[data-role='command']"),
        label: root.querySelector("[data-role='label']")
    };
}

function setStatus(text) {
    if (statusEl)
        statusEl.textContent = text;
}

function setHeadline(text) {
    if (headlineEl)
        headlineEl.textContent = text;
}

function setTotalVotes(total) {
    if (!totalEl)
        return;
    const word = declOfNum(total, ["голос", "голоса", "голосов"]);
    totalEl.textContent = `${total} ${word}`;
}

function resetWinner() {
    if (winnerEl)
        winnerEl.textContent = "";
}

function showWinner(message) {
    if (!winnerEl)
        return;
    winnerEl.textContent = message;
}

function updateVoteOption(option, data, totalVotes) {
    if (!option.root)
        return;

    const percent = totalVotes > 0 ? Math.round(data.votes / totalVotes * 100) : 0;
    const width = totalVotes > 0 ? percent : 50;

    if (option.label)
        option.label.textContent = data.label;
    if (option.command)
        option.command.textContent = data.command;
    if (option.percent)
        option.percent.textContent = `${percent}%`;
    if (option.count)
        option.count.textContent = `${data.votes} ${declOfNum(data.votes, ["голос", "голоса", "голосов"])}`;
    if (option.bar)
        option.bar.style.width = `${width}%`;
}

function highlightLeader(vote) {
    if (!options.a.root || !options.b.root)
        return;

    options.a.root.classList.remove("vote-option--lead");
    options.b.root.classList.remove("vote-option--lead");

    if (vote.totalVotes === 0)
        return;

    if (vote.condidateA.votes > vote.condidateB.votes)
        options.a.root.classList.add("vote-option--lead");
    else if (vote.condidateB.votes > vote.condidateA.votes)
        options.b.root.classList.add("vote-option--lead");
}

function renderVote(data) {
    hasActiveVote = true;
    resetWinner();
    setHeadline("Голосование активно");
    updateVoteOption(options.a, data.condidateA, data.totalVotes);
    updateVoteOption(options.b, data.condidateB, data.totalVotes);
    highlightLeader(data);
    setTotalVotes(data.totalVotes);
}

function renderIdle() {
    hasActiveVote = false;
    setHeadline("Ожидаем команду !vote");
    setTotalVotes(0);
    resetWinner();
    updateVoteOption(options.a, {
        label: "Участник A",
        command: "!A",
        votes: 0
    }, 0);
    updateVoteOption(options.b, {
        label: "Участник B",
        command: "!B",
        votes: 0
    }, 0);
    highlightLeader({
        condidateA: { votes: 0 },
        condidateB: { votes: 0 },
        totalVotes: 0
    });
}

function handleVoteEnded(payload) {
    if (!payload || !payload.data)
        return;

    hasActiveVote = false;
    setHeadline("Голосование завершено");
    showWinner(payload.winnerMessage);
    updateVoteOption(options.a, payload.data.condidateA, payload.data.totalVotes);
    updateVoteOption(options.b, payload.data.condidateB, payload.data.totalVotes);
    highlightLeader(payload.data);
    setTotalVotes(payload.data.totalVotes);
}

function declOfNum(number, words) {
    const abs = Math.abs(number) % 100;
    const lastDigit = abs % 10;

    if (abs > 10 && abs < 20)
        return words[2];
    if (lastDigit > 1 && lastDigit < 5)
        return words[1];
    if (lastDigit === 1)
        return words[0];
    return words[2];
}

renderIdle();
setStatus("Подключаемся…");

createRealtimeClient({
    open: () => setStatus("В реальном времени"),
    close: () => {
        setStatus("Ожидаем подключение…");
        if (!hasActiveVote)
            renderIdle();
    },
    init: (payload) => {
        if (!payload || !payload.vote) {
            renderIdle();
            return;
        }

        if (payload.isVoteActive)
            renderVote(payload.vote);
        else
            handleVoteEnded({ winnerMessage: "Голосование завершено", data: payload.vote });
    },
    "vote:update": renderVote,
    "vote:ended": handleVoteEnded
});
