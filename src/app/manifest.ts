import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comunidade Mariana Valentina",
    short_name: "Comunidade",
    description:
      "Comunidade por assinatura para fisioterapeutas pélvicas: condutas semanais, artigos comentados, rounds clínicos e biblioteca de materiais.",
    start_url: "/",
    display: "standalone",
    background_color: "#fefbf6",
    theme_color: "#e9726d",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
