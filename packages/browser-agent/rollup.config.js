import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

const external = [
  '@opentelemetry/api',
  '@opentelemetry/sdk-trace-web',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/context-zone',
  '@opentelemetry/resources',
  '@opentelemetry/semantic-conventions',
];

export default [
  // ESM and CJS builds (for bundlers)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
  },
  // Browser bundle (all deps included, for direct <script> use)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/browser.js',
      format: 'esm',
      sourcemap: true,
    },
    // Don't externalize - bundle everything
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
];
