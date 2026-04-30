"use client";

import { sileo } from "sileo";

const defaultOptions = {
  duration: 5200,
  roundness: 8
};

export const toast = {
  success(options) {
    return sileo.success({ ...defaultOptions, ...options });
  },
  error(options) {
    return sileo.error({ ...defaultOptions, ...options });
  },
  info(options) {
    return sileo.info({ ...defaultOptions, ...options });
  },
  warning(options) {
    return sileo.warning({ ...defaultOptions, ...options });
  },
  action(options) {
    return sileo.action({ ...defaultOptions, ...options });
  }
};
