const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const calculator = require("basic-jsmath");
const { createServer } = require("https");
const fs = require("fs");
const dotEnv = require("dotenv");
const {
  typeorm,
  getInvoices,
  chatExists,
  getChat,
  deleteChat,
  getInvoice,
  addInvoice,
} = require("./db");

dotEnv.config();

const IS_DEV = process.env.NODE_ENV === "development";

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  webHook: true,
});

bot.setWebHook(process.env.WEBHOOK_URL);

typeorm()
  .initialize()
  .then(() => {
    const app = express();

    app.use(express.json());

    const ACTIONS = {
      CLEAR: "CLEAR",
      HISTORY: "HISTORY",
      TOTAL: "TOTAL",
    };

    const getHistory = async (chatId) => {
      const invoices = await getInvoices(chatId);
      if (invoices.length === 0) return "";

      return invoices.map((invoice) => {
        return `Total for ${invoice.number}: ${invoice.history} = ${invoice.total}`;
      });
    };

    const getTotal = async (chatId) => {
      const invoices = await getInvoices(chatId);
      if (invoices.length === 0) return 0;

      return invoices.reduce((acc, curr) => {
        return acc + curr.total;
      }, 0);
    };

    app.post("/bot/a33da730-b458-49d7-8ba3-126c55356660", async (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });

    bot.on("text", async (message) => {
      let text = message.text.trim();

      if (!/^((\+|\*|\/|\-)[0-9]+|history|total|clear)/.test(text)) {
        return;
      }

      const telegram_chat_id = message.chat.id;
      const senderId = message.from.id;
      const chat = await getChat(telegram_chat_id);
      const chatId = chat.id;

      const member = await bot.getChatMember(telegram_chat_id, senderId);

      if (member.status !== "administrator" && member.status !== "creator")
        return;

      let result = "";

      switch (text) {
        case ACTIONS.TOTAL.toLowerCase():
          const total = await getTotal(chatId);

          const historyState = await getHistory(chatId);

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
          if (await chatExists(chatId)) {
            await deleteChat(chatId);
          }

          result = "History cleared! 🎉";
          break;

        case ACTIONS.HISTORY.toLowerCase():
          const history = await getHistory(chatId);

          result =
            typeof history === "string" && history.trim() === ""
              ? "There's no history"
              : `History: 
${history.join("\n")}
        `;
          break;

        default:
          try {
            const invoiceRegexp = /\#\d+/;
            const invoiceNumber = text.match(invoiceRegexp)?.[0];

            if (!invoiceNumber) {
              result = "Invoice number is required!";
              break;
            }

            const { total, history } = await getInvoice(chatId, invoiceNumber);
            text = text.replace(invoiceRegexp, "").replace(/\$/gi, "").trim();

            if (!/^(\+|\*|\/|\-)/.test(text)) {
              result =
                "Your input should be prefixed with an operation like : +,-,*,/";
              break;
            }

            let payload = calculator.parse(`${total.toString()}${text}`);

            payload = calculator.execute(payload, true).toFixed();

            const { total: new_total } = await addInvoice(chatId, {
              number: invoiceNumber,
              total: Number(payload),
              history: `${history}${text}`,
            });

            result = `Current total for ${invoiceNumber} is ${new_total}:
${/^\d+$/.test(text) ? "" : text} = ${payload}`;
          } catch (err) {
            console.log(err);
            result = "Please check your message 😐";
          }
          break;
      }

      bot.sendMessage(telegram_chat_id, result);
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
  })
  .catch((err) => {
    console.log("Could not connect to DB", err);
  });
