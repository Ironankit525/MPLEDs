import React from 'react';
import { Badge } from '../common/Badge.jsx';
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '../../constants/projectStatus.js';

export const ProjectStatus = ({ status }) => {
  const variant = PROJECT_STATUS_COLORS[status] || 'slate';
  const label = PROJECT_STATUS_LABELS[status] || status;

  return <Badge variant={variant}>{label}</Badge>;
};
