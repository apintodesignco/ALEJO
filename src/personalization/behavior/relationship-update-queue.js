/**
 * Queue manager for handling failed relationship updates
 * Implements a robust retry system for critical relationship updates that failed
 * @module relationship-update-queue
 */

import { queueManager } from '../../utils/queue-manager.js';
import { pythonBridge } from '../../utils/python-bridge.js';
import { auditTrail } from '../../utils/audit-trail.js';

// Constants
const RETRY_QUEUE_NAME = 'relationship_updates';
const MAX_RETRY_COUNT = 5;
const RETRY_INTERVALS = [
  1 * 60 * 1000,    // 1 minute
  5 * 60 * 1000,    // 5 minutes
  30 * 60 * 1000,   // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  6 * 60 * 60 * 1000  // 6 hours
];

/**
 * Enqueue a failed relationship update for later retry
 * @param {string} userId - User identifier
 * @param {string} entityId - Entity identifier
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @param {number} strength - Preference strength
 * @returns {Promise<boolean>} Success status
 */
export async function enqueueFailedRelationshipUpdate(userId, entityId, key, value, strength) {
  try {
    const payload = {
      userId,
      entityId,
      key, 
      value,
      strength,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    await queueManager.enqueue(RETRY_QUEUE_NAME, payload);
    
    auditTrail.log('relationship:update:queued', {
      userId,
      entityId,
      key
    });
    
    return true;
  } catch (error) {
    console.error('Failed to enqueue relationship update:', error);
    return false;
  }
}

/**
 * Process the relationship update queue
 * This should be called by a background worker
 * @returns {Promise<number>} Number of processed items
 */
export async function processRelationshipUpdateQueue() {
  let processedCount = 0;
  
  try {
    const queueItems = await queueManager.dequeueMany(RETRY_QUEUE_NAME, 20);
    
    for (const item of queueItems) {
      try {
        const { userId, entityId, key, value, strength, retryCount } = item.payload;
        
        // Determine sentiment from key if possible
        let sentimentValue = strength;
        const entityMatch = key.match(/relationship:(liked|disliked):(\w+):(.+)/);
        if (entityMatch) {
          const [, sentiment] = entityMatch;
          sentimentValue = sentiment === 'liked' ? strength : -strength;
        }
        
        // Try to update relationship again
        await pythonBridge.callPython(
          'alejo.cognitive.memory.relationship_memory',
          'record_preference_interaction',
          [
            userId,
            entityId,
            'preference_update',
            `User ${sentimentValue > 0 ? 'likes' : 'dislikes'} ${key}`,
            sentimentValue,
            0.7,  // Medium-high importance
            { preference_key: key, preference_value: value }
          ]
        );
        
        // Success - remove from queue
        await queueManager.complete(item.id);
        
        auditTrail.log('relationship:update:retry:success', {
          userId,
          entityId,
          key,
          retryCount
        });
        
        processedCount++;
      } catch (error) {
        // Failed again - increment retry count and requeue with delay
        const { retryCount } = item.payload;
        
        if (retryCount >= MAX_RETRY_COUNT) {
          // Too many retries, log as failed and remove from queue
          auditTrail.log('relationship:update:retry:failed', {
            userId: item.payload.userId,
            entityId: item.payload.entityId,
            key: item.payload.key,
            retryCount,
            error: error.message
          });
          
          await queueManager.complete(item.id);
        } else {
          // Update retry count and requeue
          const updatedPayload = {
            ...item.payload,
            retryCount: retryCount + 1,
            lastAttempt: Date.now()
          };
          
          const delayMs = RETRY_INTERVALS[retryCount] || 24 * 60 * 60 * 1000; // Default to 24 hours for high counts
          
          await queueManager.requeue(item.id, updatedPayload, delayMs);
          
          auditTrail.log('relationship:update:retry:requeued', {
            userId: item.payload.userId,
            entityId: item.payload.entityId,
            key: item.payload.key,
            retryCount: retryCount + 1,
            nextAttemptDelay: delayMs
          });
        }
      }
    }
    
    return processedCount;
  } catch (error) {
    console.error('Error processing relationship update queue:', error);
    return processedCount;
  }
}
