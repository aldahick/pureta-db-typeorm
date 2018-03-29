import * as _ from "lodash";
import * as path from "path";
import * as pureta from "pureta";
import * as orm from "typeorm";
import NamingStrategy from "./lib/NamingStrategy";

export default class TypeORMPlugin extends pureta.Plugin {
    dirs = {};
    private static connections: orm.Connection[] = [];

    public static db(identifier: string | pureta.RequestHandler): orm.Connection {
        if (identifier instanceof pureta.RequestHandler) identifier = identifier.config.get("http.host");
        return orm.getConnection(<string>identifier);
    }

    async registerHandlers() {
        this.app.on("app:start", this.onAppStart.bind(this));
        this.app.on("app:stop", this.onAppStop.bind(this));
    }

    private async onAppStart() {
        const modelDirs: string[] = Object.values(this.app.plugins)
            .map(p => (<string[]>(<any>p.plugin).modelDirs || [])
                .map(d => path.resolve(p.baseDir, d))
            ).reduce((p, v) => p.concat(v), [])
            .map(d => d + (d.endsWith("/") ? "" : "/") + "*.js");
        TypeORMPlugin.connections = await Promise.all(Object.keys(this.app.configs).filter(k => k !== "global").map(host => {
            const config = this.app.configs[host];
            const options = _.defaults<orm.ConnectionOptions, Partial<orm.ConnectionOptions>>(<any>config.buildToObject("db."), {
                entities: modelDirs,
                synchronize: true,
                name: config.get("http.host"),
                namingStrategy: new NamingStrategy()
            });
            return orm.createConnection(options);
        }));
    }

    private async onAppStop() {
        await Promise.all(TypeORMPlugin.connections.map(c => c.close()));
    }
}
