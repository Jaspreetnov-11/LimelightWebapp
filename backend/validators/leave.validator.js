'use strict';

const applyLeaveSchema = {
  from_date: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'from_date is required and must be YYYY-MM-DD'
  },
  to_date: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'to_date is required and must be YYYY-MM-DD',
    custom: (to, data) => {
      if (data.from_date && to < data.from_date) {
        return 'to_date cannot be earlier than from_date';
      }
      return true;
    }
  },
  reason: {
    required: false
  }
};

module.exports = {
  applyLeaveSchema
};
