/**
 * Groups messages by date for better chat organization
 * @param {Array} messages - Array of message objects with createdAt field
 * @returns {Array} - Array with messages and date separators
 */
export const groupMessagesByDate = (messages) => {
  if (!messages || messages.length === 0) return [];

  const grouped = [];
  let currentDate = null;

  messages.forEach((message) => {
    const messageDate = message.createdAt instanceof Date 
      ? message.createdAt 
      : new Date(message.createdAt);
    
    const messageDateString = messageDate.toDateString();

    // Add date separator if this is a new date
    if (currentDate !== messageDateString) {
      grouped.push({
        type: 'separator',
        date: messageDate.getTime(),
        id: `separator_${messageDate.getTime()}`
      });
      currentDate = messageDateString;
    }

    // Add the message
    grouped.push({
      ...message,
      type: 'message',
      createdAt: messageDate
    });
  });

  return grouped;
};

/**
 * Formats a timestamp for display in chat
 * @param {Date|string|number} timestamp - The timestamp to format
 * @returns {string} - Formatted time string
 */
export const formatMessageTime = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Formats a date for display as a separator
 * @param {Date|string|number} timestamp - The timestamp to format
 * @returns {string} - Formatted date string
 */
export const formatMessageDate = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};

/**
 * Checks if two messages should be grouped together (same sender, close time)
 * @param {Object} message1 - First message
 * @param {Object} message2 - Second message
 * @param {number} timeThreshold - Time threshold in minutes (default: 5)
 * @returns {boolean} - Whether messages should be grouped
 */
export const shouldGroupMessages = (message1, message2, timeThreshold = 5) => {
  if (!message1 || !message2) return false;
  if (message1.senderId !== message2.senderId) return false;

  const time1 = message1.createdAt instanceof Date ? message1.createdAt : new Date(message1.createdAt);
  const time2 = message2.createdAt instanceof Date ? message2.createdAt : new Date(message2.createdAt);
  
  const timeDiff = Math.abs(time2.getTime() - time1.getTime()) / (1000 * 60); // in minutes
  
  return timeDiff <= timeThreshold;
};

