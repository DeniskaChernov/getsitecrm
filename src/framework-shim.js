import * as React from 'react';
import * as ReactJSX from 'react/jsx-runtime';
import * as ReactDOMClient from 'react-dom/client';

/** Vinext-compatible factories used by the GetSite OS client bundle. */
export function i() {
  return React;
}

export function r() {
  return ReactJSX;
}

export function n() {
  return ReactDOMClient;
}

export function t() {
  return ReactDOMClient;
}
