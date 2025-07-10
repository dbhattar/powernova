const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class JobQueue {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.queueName = 'vectorization_jobs';
    this.statusPrefix = 'job_status:';
  }

  async enqueue(job) {
    const jobId = job.id || uuidv4();
    const jobData = {
      id: jobId,
      type: job.type,
      payload: job.payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null
    };

    // Store job status
    await this.redis.hset(
      `${this.statusPrefix}${jobId}`,
      'data',
      JSON.stringify(jobData)
    );

    // Add to queue
    await this.redis.lpush(this.queueName, jobId);

    console.log(`📋 Job ${jobId} enqueued for ${job.type}`);
    return jobId;
  }

  async dequeue() {
    // Blocking pop from queue (wait 1 second)
    const result = await this.redis.brpop(this.queueName, 1);
    if (!result) {
      return null;
    }

    const jobId = result[1];
    const jobDataStr = await this.redis.hget(`${this.statusPrefix}${jobId}`, 'data');
    
    if (!jobDataStr) {
      return null;
    }

    return JSON.parse(jobDataStr);
  }

  async updateJobStatus(jobId, status, error = null) {
    const jobDataStr = await this.redis.hget(`${this.statusPrefix}${jobId}`, 'data');
    if (!jobDataStr) {
      throw new Error(`Job ${jobId} not found`);
    }

    const jobData = JSON.parse(jobDataStr);
    jobData.status = status;

    if (status === 'processing') {
      jobData.startedAt = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      jobData.completedAt = new Date().toISOString();
      if (error) {
        jobData.error = error;
      }
    }

    await this.redis.hset(
      `${this.statusPrefix}${jobId}`,
      'data',
      JSON.stringify(jobData)
    );

    console.log(`📋 Job ${jobId} status updated to ${status}`);
    return jobData;
  }

  async getJobStatus(jobId) {
    const jobDataStr = await this.redis.hget(`${this.statusPrefix}${jobId}`, 'data');
    if (!jobDataStr) {
      return null;
    }

    return JSON.parse(jobDataStr);
  }

  async disconnect() {
    await this.redis.disconnect();
  }
}

module.exports = new JobQueue();
