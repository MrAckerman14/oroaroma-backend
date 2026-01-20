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

    await queryInterface.createTable('inventory_reports', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      from: { type: Sequelize.DATEONLY, allowNull: false },
      to: { type: Sequelize.DATEONLY, allowNull: false },
      created_by: { 
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      total_products: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_inventory_value: { type: Sequelize.DECIMAL(18,2), allowNull: false, defaultValue: 0 },
      createdAt: {  
         allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: { 
          allowNull: false,
          type: Sequelize.DATE,
       },
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
     await queryInterface.dropTable('inventory_reports')
  }
};
