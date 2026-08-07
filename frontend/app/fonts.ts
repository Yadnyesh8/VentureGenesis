// No webfonts. The interface runs on the platform UI stack — the same choice the
// reference design makes — so type paints on the first frame with no FOUT and no
// swap reflow. The mono is used sparingly, only for small tracked section labels.

export const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

export const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
