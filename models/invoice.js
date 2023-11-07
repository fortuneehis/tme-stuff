const { EntitySchema } = require("typeorm");
const Chat = require("./chat");

const Invoice = new EntitySchema({
  name: "Invoice",
  columns: {
    id: {
      generated: true,
      type: "int",
      primary: true,
    },
    number: {
      unique: true,
      type: "varchar",
    },
    total: {
      type: "int",
    },
    history: {
      type: "varchar",
    },
  },
  relations: {
    chats: {
      target: "Chat",
      type: "many-to-one",
      inverseSide: "invoices",
      onDelete: "cascade",
    },
  },
});

module.exports = Invoice;
