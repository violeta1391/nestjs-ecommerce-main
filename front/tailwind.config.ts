import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#c1292e',
          background: '#ffffff',
          active: '#c1292e',
          header: '#e2e1e1',
        },
      },
      backgroundImage: {
        'sidemenu': "url('/assets/sidemenu-bg.jpg')",
      },
    },
  },
  plugins: [],
};

export default config;
