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
    await queryInterface.addColumn('sales', 'phone', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('sales', 'amount_cash', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('sales', 'amount_transfer', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn('sales','phone');
    await queryInterface.removeColumn('sales','amount_cash');
    await queryInterface.removeColumn('sales','amount_transfer');
  }
};
