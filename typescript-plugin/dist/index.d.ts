declare const _default: ({ typescript: ts }: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) => {
    create: (info: import("typescript/lib/tsserverlibrary").server.PluginCreateInfo) => import("typescript").LanguageService;
};
export = _default;
