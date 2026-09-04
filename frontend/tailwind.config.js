/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep clinical teal-blue: trust, precision, calm - the SMArT brand color
        brand: {
          50: '#EBF3F4',
          100: '#D2E4E6',
          300: '#79ABB0',
          500: '#1F7A82',
          600: '#166069',
          700: '#0B4F6C',   // primary
          900: '#062F3D',
        },
        surface: {
          DEFAULT: '#F5F8F9',
          card: '#FFFFFF',
          muted: '#EEF3F4',
          border: '#E2E9EA',
        },
        status: {
          pass: '#16A34A',
          passBg: '#EAF7EE',
          bad: '#D97706',
          badBg: '#FDF3E4',
          fail: '#DC2626',
          failBg: '#FCEBEA',
          pending: '#94A3B8',
        },
        ink: {
          900: '#101828',
          700: '#344054',
          500: '#667085',
          300: '#98A2B3',
        },
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.06)',
      },
    },
  },
  plugins: [],
};
