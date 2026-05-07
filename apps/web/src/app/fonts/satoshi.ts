import localFont from 'next/font/local';

export const satoshi = localFont({
  src: [
    {
      path: '../../../public/fonts/satoshi/Satoshi-Variable.woff2',
      style: 'normal',
      weight: '300 900',
    },
    {
      path: '../../../public/fonts/satoshi/Satoshi-VariableItalic.woff2',
      style: 'italic',
      weight: '300 900',
    },
  ],
  variable: '--font-satoshi',
  display: 'swap',
});
