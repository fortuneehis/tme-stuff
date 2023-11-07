const { config } = require("dotenv");
const { Invoice, Chat } = require("./models");
const { DataSource } = require("typeorm");

config();

const dbOptions = {
  type: "postgres",
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const datasource = new DataSource({
  ...dbOptions,
  entities: [Invoice, Chat],
  synchronize: true,
});

const typeorm = (options) => {
  return datasource;
};

const invoiceRepository = datasource.getRepository(Invoice);
const chatRepository = datasource.getRepository(Chat);

const chatExists = async (chatId) => {
  return chatRepository.exist({
    where: {
      id: chatId,
    },
  });
};

const addChat = (chatId) => {
  const chatEntity = chatRepository.create({
    telegram_chat_id: chatId,
  });
  return chatRepository.save(chatEntity);
};

const getChat = async (chatId) => {
  const chat = await chatRepository.findOne({
    where: {
      telegram_chat_id: chatId,
    },
  });

  if (!chat) {
    return addChat(chatId);
  }
  return chat;
};

const addInvoice = async (chatId, payload) => {
  let invoice =
    (await invoiceRepository.findOne({
      where: {
        number: payload.number,
        chats: {
          id: chatId,
        },
      },
    })) ??
    invoiceRepository.create({
      chats: {
        id: chatId,
      },
    });

  invoice = {
    ...invoice,
    ...payload,
  };

  return invoiceRepository.save(invoice);
};

const getInvoices = async (chatId) => {
  const invoices = await invoiceRepository.find({
    where: {
      chats: {
        id: chatId,
      },
    },
  });
  return invoices;
};

const getInvoice = async (chatId, invoiceNumber) => {
  const invoice = await invoiceRepository.findOne({
    where: {
      number: invoiceNumber,
      chats: {
        id: chatId,
      },
    },
  });

  if (!invoice) {
    return {
      total: 0,
      history: "",
    };
  }
  return invoice;
};

const deleteChat = async (chatId) => {
  return chatRepository.delete({
    id: chatId,
  });
};
module.exports = {
  typeorm,
  getChat,
  addInvoice,
  deleteChat,
  getInvoices,
  getInvoice,
  chatExists,
};
