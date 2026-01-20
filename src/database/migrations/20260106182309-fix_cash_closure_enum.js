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

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_cash_closures_status RENAME VALUE 'Verificacdo' TO 'Verificado';
    `)

  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

     await queryInterface.sequelize.query(`
      ALTER TYPE enum_cash_closures_status RENAME VALUE 'Verificado' TO 'Verificacdo';
    `)
  }
};

module.exports = {
  async up (queryInterface, Sequelize) {

    
  },

  async down (queryInterface) {
   
  }
};