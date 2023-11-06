const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const calculator = require("basic-jsmath");
const { createServer } = require("node:https");
const fs = require("fs");
const dotEnv = require("dotenv");

dotEnv.config();

const IS_DEV = process.env.NODE_ENV === "development";

const app = express();

app.use(express.json());

const ACTIONS = {
  CLEAR: "CLEAR",
  HISTORY: "HISTORY",
  TOTAL: "TOTAL",
};

const CHAT_STATE = new Map();

const INVOICE_STATE = new Map();

const getInvoiceState = (chatId, invoiceNumber) => {
  const invoiceNumbers = CHAT_STATE.has(chatId) ? CHAT_STATE.get(chatId) : [];

  invoiceNumbers.push(invoiceNumber);

  CHAT_STATE.set(chatId, Array.from(new Set(invoiceNumbers)));

  return INVOICE_STATE.has(invoiceNumber)
    ? INVOICE_STATE.get(invoiceNumber)
    : {
        total: 0,
        history: "",
      };
};

const getHistory = (chatId) => {
  const invoiceNumbers = CHAT_STATE.get(chatId);

  if (!invoiceNumbers) return "";

  return invoiceNumbers.map((invoiceNumber) => {
    const { history, total } = getInvoiceState(chatId, invoiceNumber);
    return `Total for ${invoiceNumber}: ${history} = ${total}`;
  });
};

const getTotal = (chatId) => {
  const invoiceNumbers = CHAT_STATE.get(chatId);

  if (!invoiceNumbers) return 0;

  return invoiceNumbers.reduce((acc, curr) => {
    let total = 0;

    const state = INVOICE_STATE.get(curr);

    if (state) {
      total = state.total;
    }

    return acc + total;
  }, 0);
};

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  webHook: true,
});

bot.setWebHook(process.env.WEBHOOK_URL);

app.post("/bot/a33da730-b458-49d7-8ba3-126c55356660", async (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on("text", (message) => {
  let text = message.text.trim();
  const chatId = message.chat.id;

  let result = "";

  switch (text) {
    case ACTIONS.TOTAL.toLowerCase():
      const total = getTotal(chatId);

      const historyState = getHistory(chatId);

      result =
        typeof historyState === "string" &&
        total === 0 &&
        historyState.trim() === ""
          ? "There's no history to calculate the total"
          : `History: 
${historyState.join("\n")}

Sum Total = ${total}
`;

      break;
    case ACTIONS.CLEAR.toLowerCase():
      if (CHAT_STATE.has(chatId)) {
        const chatState = CHAT_STATE.get(chatId);
        chatState.forEach((invoiceNumber) => {
          INVOICE_STATE.delete(invoiceNumber);
        });
        CHAT_STATE.delete(chatId);
      }
      result = "History cleared! 🎉";
      break;

    case ACTIONS.HISTORY.toLowerCase():
      const history = getHistory(chatId);

      result =
        typeof history === "string" && history.trim() === ""
          ? "There's no history"
          : `History: 
${history.join("\n")}
        `;
      break;

    default:
      try {
        const chatId = message.chat.id;

        const invoiceRegexp = /\#\d+/;
        const invoiceNumber = text.match(invoiceRegexp)?.[0];

        if (!invoiceNumber) {
          result = "Invoice number is required!";
          break;
        }

        const { total, history } = getInvoiceState(chatId, invoiceNumber);

        text = text.replace(invoiceRegexp, "").replaceAll(/\$/gi, "").trim();

        if (!/^(\+|\*|\/|\-)/.test(text)) {
          result =
            "Your input should be prefixed with an operation like : +,-,*,/";
          break;
        }

        let payload = calculator.parse(`${total.toString()}${text}`);

        payload = calculator.execute(payload, true).toFixed();

        INVOICE_STATE.set(invoiceNumber, {
          total: Number(payload),
          history: `${history}${text}`,
        });

        const { total: new_total } = getInvoiceState(chatId, invoiceNumber);

        result = `Current total for ${invoiceNumber} is ${new_total}:
${/^\d+$/.test(text) ? "" : text} = ${payload}`;
      } catch (err) {
        console.log(err);
        result = "Please check your message 😐";
      }
      break;
  }

  bot.sendMessage(chatId, result);
});

const server = IS_DEV
  ? createServer(
      {
        key: fs.readFileSync("./localhost-key.pem"),
        cert: fs.readFileSync("./localhost.pem"),
      },
      app
    )
  : app;

server.listen(3000, () => {
  console.log("Listening...");
});
