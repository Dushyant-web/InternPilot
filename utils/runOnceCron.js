/*
 * node-cron, with one change: when app instances share a Redis (REDIS_URL),
 * each scheduled run happens on only one of them. Every instance still
 * schedules the job; at run time they race for a lock on that run, the winner
 * runs it and the others skip it. Without Redis, or when Redis can't be
 * reached, every instance runs the job, as before.
 */
const crypto = require('crypto');
const nodeCron = require('node-cron');
const cache = require('./cache');

// Every run has its own lock key, so this only has to outlast clock drift
// between servers. It stops old lock keys piling up in Redis.
const LOCK_SECONDS = 10 * 60;

/** A name for the job that's the same on every instance running this code. */
function jobId(expression, task, options) {
    if (options && options.name) return String(options.name);
    const source = crypto.createHash('sha1').update(String(task)).digest('hex').slice(0, 12);
    return `${expression}#${source}`;
}

/** The planned time of this run. node-cron passes it in the task context. */
function runTime(context, now) {
    const planned = context && context.date;
    if (planned instanceof Date && !Number.isNaN(planned.getTime())) return planned;
    return new Date(Math.floor(now() / 60000) * 60000);
}

function createRunOnceCron({ cron = nodeCron, store = cache, now = Date.now } = {}) {
    return {
        ...cron,
        schedule(expression, task, options) {
            const id = jobId(expression, task, options);
            const runOnce = async (context, ...rest) => {
                const key = `cron:${id}:${runTime(context, now).toISOString()}`;
                if (!(await store.claim(key, LOCK_SECONDS))) return undefined;
                return task(context, ...rest);
            };
            return cron.schedule(expression, runOnce, options);
        }
    };
}

module.exports = createRunOnceCron();
module.exports.createRunOnceCron = createRunOnceCron;
