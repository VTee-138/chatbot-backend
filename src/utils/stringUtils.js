function toHourMinute(time) {
    try {
        return new Date(time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
    } catch (error) {
        return new Date(0).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
    }
}

module.exports = {
    toHourMinute
};