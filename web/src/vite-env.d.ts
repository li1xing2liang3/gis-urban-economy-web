/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';

  function getShapefile(
    base: string | ArrayBuffer | { shp: ArrayBuffer | DataView; dbf?: ArrayBuffer | DataView; prj?: string; cpg?: string },
  ): Promise<FeatureCollection | FeatureCollection[]>;

  export default getShapefile;
}
