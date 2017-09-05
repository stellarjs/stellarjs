/**
 * Created by arolave on 02/02/2017.
 */
import Job from 'bull/lib/job';
import Queue from 'bull/lib/queue';
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
    return Job.create(new Queue(this.name, this.client), data, opts);
  }

  distEmit() { // eslint-disable-line class-methods-use-this
    // do nothing
  }
}

export default Enqueuer;
