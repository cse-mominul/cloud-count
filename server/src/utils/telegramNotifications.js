const axios = require("axios");
const Settings = require("../models/Settings");

/**
 * Send Telegram notification
 * @param {string} message - The message to send
 * @param {string} parseMode - Optional parse mode (HTML or Markdown)
 * @returns {Promise<boolean>} - Returns true if sent successfully, false otherwise
 */
const sendTelegramNotification = async (message, parseMode = "HTML") => {
  try {
    // Get settings
    const settings = await Settings.getSettings();
    
    // Check if Telegram is enabled and configured
    if (!settings.isTelegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) {
      console.log("Telegram notifications not enabled or not configured");
      return false;
    }

    // Send message to Telegram
    const telegramUrl = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    
    const payload = {
      chat_id: settings.telegramChatId,
      text: message,
      parse_mode: parseMode
    };

    const response = await axios.post(telegramUrl, payload, {
      timeout: 5000 // 5 second timeout
    });

    if (response.data.ok) {
      console.log("Telegram notification sent successfully");
      return true;
    } else {
      console.error("Telegram API error:", response.data);
      return false;
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error.message);
    return false;
  }
};

/**
 * Send formatted notification for different events
 * @param {string} eventType - Type of event (invoice, product, expense)
 * @param {Object} data - Event data
 * @returns {Promise<boolean>}
 */
const sendEventNotification = async (eventType, data) => {
  try {
    const settings = await Settings.getSettings();
    
    if (!settings.isTelegramEnabled) {
      return false;
    }

    let message = "";
    const companyName = settings.companyName || "Inventory System";

    switch (eventType) {
      case "invoice_created":
        message = `📄 <b>New Invoice Created</b>\n\n`;
        message += `<b>Company:</b> ${companyName}\n`;
        message += `<b>Invoice ID:</b> #${data.invoiceNumber || data._id}\n`;
        message += `<b>Customer:</b> ${data.customer?.name || 'N/A'}\n`;
        message += `<b>Total:</b> ${data.total || 0} ${settings.currency || 'BDT'}\n`;
        message += `<b>Created by:</b> ${data.createdBy?.name || 'System'}\n`;
        message += `<b>Time:</b> ${new Date().toLocaleString()}`;
        break;

      case "product_low_stock":
        message = `⚠️ <b>Low Stock Alert</b>\n\n`;
        message += `<b>Company:</b> ${companyName}\n`;
        message += `<b>Product:</b> ${data.name}\n`;
        message += `<b>Current Stock:</b> ${data.stock} units\n`;
        message += `<b>Threshold:</b> ${settings.lowStockThreshold || 5} units\n`;
        message += `<b>SKU:</b> ${data.sku || 'N/A'}\n`;
        message += `<b>Time:</b> ${new Date().toLocaleString()}`;
        break;

      case "product_deleted":
        message = `🗑️ <b>Product Deleted</b>\n\n`;
        message += `<b>Company:</b> ${companyName}\n`;
        message += `<b>Product:</b> ${data.name}\n`;
        message += `<b>SKU:</b> ${data.sku || 'N/A'}\n`;
        message += `<b>Stock was:</b> ${data.stock || 0} units\n`;
        message += `<b>Deleted by:</b> ${data.deletedBy?.name || 'System'}\n`;
        message += `<b>Time:</b> ${new Date().toLocaleString()}`;
        break;

      case "expense_added":
        message = `💰 <b>New Expense Added</b>\n\n`;
        message += `<b>Company:</b> ${companyName}\n`;
        message += `<b>Category:</b> ${data.category}\n`;
        message += `<b>Amount:</b> ${data.amount} ${settings.currency || 'BDT'}\n`;
        message += `<b>Description:</b> ${data.description || 'N/A'}\n`;
        message += `<b>Date:</b> ${data.date || new Date().toLocaleDateString()}\n`;
        message += `<b>Added by:</b> ${data.addedBy?.name || 'System'}\n`;
        message += `<b>Time:</b> ${new Date().toLocaleString()}`;
        break;

      case "user_login":
        message = `🔐 <b>User Login</b>\n\n`;
        message += `<b>Company:</b> ${companyName}\n`;
        message += `<b>User:</b> ${data.name}\n`;
        message += `<b>Email:</b> ${data.email}\n`;
        message += `<b>Role:</b> ${data.role}\n`;
        message += `<b>Time:</b> ${new Date().toLocaleString()}`;
        break;

      default:
        message = `📢 <b>System Notification</b>\n\n`;
        message += `<b>Company:</b> ${companyName}\n`;
        message += `<b>Event:</b> ${eventType}\n`;
        message += `<b>Time:</b> ${new Date().toLocaleString()}`;
    }

    return await sendTelegramNotification(message, "HTML");
  } catch (error) {
    console.error("Error sending event notification:", error.message);
    return false;
  }
};

/**
 * Test Telegram connection
 * @param {string} botToken - Optional bot token (if not provided, uses settings)
 * @param {string} chatId - Optional chat ID (if not provided, uses settings)
 * @returns {Promise<Object>}
 */
const testTelegramConnection = async (botToken = null, chatId = null) => {
  try {
    let testBotToken, testChatId, companyName;
    
    if (botToken && chatId) {
      // Use provided credentials
      testBotToken = botToken;
      testChatId = chatId;
      const settings = await Settings.getSettings();
      companyName = settings.companyName || 'Inventory System';
    } else {
      // Use settings from database
      const settings = await Settings.getSettings();
      
      if (!settings.isTelegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) {
        return { success: false, message: "Telegram not configured" };
      }
      
      testBotToken = settings.telegramBotToken;
      testChatId = settings.telegramChatId;
      companyName = settings.companyName || 'Inventory System';
    }

    // Use plain text to avoid HTML parsing issues
    const message = `🤖 Test Message\n\nTelegram notifications are working correctly!\n\nCompany: ${companyName}\nTime: ${new Date().toLocaleString()}`;
    
    // Send message directly using provided credentials
    const telegramUrl = `https://api.telegram.org/bot${testBotToken}/sendMessage`;
    
    const payload = {
      chat_id: testChatId,
      text: message
    };

    const response = await axios.post(telegramUrl, payload, {
      timeout: 5000 // 5 second timeout
    });

    if (response.data.ok) {
      console.log("Telegram test message sent successfully");
      return { success: true, message: "Test message sent successfully" };
    } else {
      console.error("Telegram API error:", response.data);
      return { success: false, message: `Telegram API error: ${response.data.description || 'Unknown error'}` };
    }
  } catch (error) {
    console.error("Error testing Telegram connection:", error.message);
    if (error.response && error.response.data) {
      return { success: false, message: `Telegram API error: ${error.response.data.description || error.message}` };
    }
    return { success: false, message: error.message };
  }
};

module.exports = {
  sendTelegramNotification,
  sendEventNotification,
  testTelegramConnection
};
