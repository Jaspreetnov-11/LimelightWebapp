'use strict';

const createPaymentSchema = {
  emp: {
    required: true,
    message: 'Employee ID is required'
  },
  date: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Date is required and must be YYYY-MM-DD'
  },
  amount: {
    required: true,
    type: 'number',
    min: 1,
    message: 'Amount must be a number greater than 0'
  },
  type: {
    required: true,
    enum: ['Salary', 'Advance', 'Bonus', 'Reimbursement', 'Fine'],
    message: 'Type must be one of: Salary, Advance, Bonus, Reimbursement, Fine'
  },
  note: {
    required: false
  }
};

module.exports = {
  createPaymentSchema
};
