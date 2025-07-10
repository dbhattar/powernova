const webSocketManager = require('./webSocketManager');

class NotificationService {
  static async notifyDocumentProcessed(document, status, error = null) {
    const message = {
      type: 'document_processed',
      data: {
        documentId: document.id,
        fileName: document.fileName,
        status: status,
        error: error,
        processedAt: document.processedAt || new Date().toISOString()
      }
    };

    const sent = await webSocketManager.sendToUser(document.userId, message);
    if (sent) {
      console.log(`📡 Notified user ${document.userId} about document ${document.id} status: ${status}`);
    }
  }

  static async notifyJobProgress(userId, jobId, status, progress = null, message = null) {
    const notification = {
      type: 'job_progress',
      data: {
        jobId: jobId,
        status: status,
        progress: progress,
        message: message
      }
    };

    const sent = await webSocketManager.sendToUser(userId, notification);
    if (sent) {
      console.log(`📡 Notified user ${userId} about job ${jobId} progress: ${status}`);
    }
  }
}

module.exports = NotificationService;
