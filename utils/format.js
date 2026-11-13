function formatPrice(value) {
    const amount = Math.round(Number(value) * 100) / 100;
    if (!Number.isFinite(amount)) {
        return '¥0';
    }
    if (amount % 1 === 0) {
        return '¥' + amount;
    }
    return '¥' + amount.toFixed(2);
}

function pad(value) {
    return value < 10 ? '0' + value : String(value);
}

function formatClock(timestamp) {
    const date = new Date(timestamp);
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return (
        date.getMonth() +
        1 +
        '月' +
        date.getDate() +
        '日 ' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes())
    );
}

function makeOrderNo(timestamp) {
    const date = new Date(timestamp);
    const tail = String(timestamp).slice(-4);
    return (
        'SG' +
        String(date.getFullYear()).slice(2) +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        tail
    );
}

module.exports = {
    formatPrice: formatPrice,
    formatClock: formatClock,
    formatDateTime: formatDateTime,
    makeOrderNo: makeOrderNo,
};
