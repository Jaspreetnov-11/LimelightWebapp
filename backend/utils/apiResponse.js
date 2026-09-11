'use strict';

/**
 * Standardized API response formatters (View layer / Presenter in MVC)
 * DRY principle: ensures consistent JSON output across all endpoints.
 */
const apiResponse = {
  success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
    const payload = {
      success: true,
      message,
      data
    };
    if (meta) {
      payload.meta = meta;
    }
    return res.status(statusCode).json(payload);
  },

  created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  },

  paginated(res, items = [], total = 0, page = 1, limit = 50, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data: items,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / limit)
      }
    });
  },

  error(res, message = 'Internal server error', statusCode = 500, details = null) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        statusCode,
        details
      }
    });
  }
};

module.exports = apiResponse;
