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
    await queryInterface.createTable('cash_closures', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },

      from_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      to_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      total_cash: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      total_trans: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      total_sale: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      total_messenger_cost: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      net_total: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      total_perfumes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM('Pendiente','Verificacdo','Anulado'),
        allowNull: false,
        defaultValue: 'Pendiente',
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

       deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // await queryInterface.addConstraint('cash_closures', {
    //   fields: ['from_date', 'to_date'],
    //   type: 'unique',
    //   name: 'unique_period_closure'
    // });

  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('cash_closures');
  }
};
