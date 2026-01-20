'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('inventory_report_details', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      inventory_report_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inventory_reports', key: 'id' },
        onDelete: 'CASCADE'
      },
      product_id: { type: Sequelize.INTEGER, allowNull: false },
      product_name: { type: Sequelize.STRING, allowNull: false },
      price: { type: Sequelize.DECIMAL(18,2), allowNull: false },
      stock: { type: Sequelize.INTEGER, allowNull: false },
      inventory_value: { type: Sequelize.DECIMAL(18,2), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: {
          allowNull: true,
          type: Sequelize.DATE,
      }
    })
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
      await queryInterface.dropTable('inventory_report_details')
  }
};
