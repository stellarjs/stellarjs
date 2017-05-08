/**
 * Created by arolave on 02/02/2017.
 */
const Job = require('bull/lib/job');

class Enqueuer {
    constructor(name, { keyPrefix, client }) {
        this.client = client;
        this.name = name;
        this.keyPrefix = keyPrefix || 'bull';
    }

    toKey(queueType) {
        return [this.keyPrefix, this.name, queueType].join(':');
    }

    add(data, opts) {
        return Job.create(this, data, opts);
    }

    distEmit() { // eslint-disable-line class-methods-use-this
        // do nothing
    }
}

module.exports = Enqueuer;
