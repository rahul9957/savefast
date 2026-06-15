const { getSettings, updateSettings } = require('../services/firestore');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/config
 * Retrieves configuration values (public variables)
 */
const getPublicConfig = async (req, res, next) => {
  try {
    const config = await getSettings();
    return sendSuccess(res, {
      backendApiUrl: config.backendApiUrl || '',
      maintenanceMode: !!config.maintenanceMode
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/config
 * Retrieves complete configuration values (admin-restricted)
 */
const getAdminConfig = async (req, res, next) => {
  try {
    const config = await getSettings();
    return sendSuccess(res, { config });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/config
 * Updates configuration settings (admin-restricted)
 */
const updateAdminConfig = async (req, res, next) => {
  const { backendApiUrl, frontendDomain, maintenanceMode } = req.body || {};
  
  if (backendApiUrl === undefined && frontendDomain === undefined && maintenanceMode === undefined) {
    return sendError(res, 'At least one configuration property (backendApiUrl, frontendDomain, maintenanceMode) must be provided.', 400);
  }

  try {
    const updatePayload = {};
    if (backendApiUrl !== undefined) updatePayload.backendApiUrl = backendApiUrl;
    if (frontendDomain !== undefined) updatePayload.frontendDomain = frontendDomain;
    if (maintenanceMode !== undefined) updatePayload.maintenanceMode = !!maintenanceMode;

    const updated = await updateSettings(updatePayload, 'admin-portal');
    return sendSuccess(res, {
      message: 'System configurations updated successfully and are now live.',
      config: updated
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicConfig,
  getAdminConfig,
  updateAdminConfig
};
