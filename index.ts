import * as _ from "lodash";
import * as path from "path";
import * as pureta from "pureta";
import * as orm from "typeorm";

export default class TypeORMPlugin extends pureta.Plugin {
    dirs = {};
    private connections: orm.Connection[] = [];

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
        this.connections = await Promise.all(Object.keys(this.app.configs).filter(k => k !== "global").map(host => {
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
        await Promise.all(this.connections.map(c => c.close()));
    }
}

class NamingStrategy extends orm.DefaultNamingStrategy implements orm.NamingStrategyInterface {
    public tableName(targetName: string, userName?: string): string {
        return _.snakeCase(userName || targetName);
    }
    public columnName(propertyName: string, userName: string, prefixes: string[]): string {
        return _.snakeCase(prefixes.concat([userName || propertyName]).join("_"));
    }
    public relationName(propertyName: string): string {
        return _.snakeCase(propertyName);
    }
    public joinColumnName(relationName: string, referencedColumnName: string): string {
        return _.snakeCase(relationName + "_" + referencedColumnName);
    }
    // @ts-ignore: secondTableName is unused
    public joinTableName(firstTableName: string, secondTableName: string, firstPropertyName: string): string {
        return _.snakeCase(firstTableName + "_" + firstPropertyName);
    }
    public joinTableColumnName(tableName: string, propertyName: string, columnName: string): string {
        return _.snakeCase(tableName + "_" + (columnName || propertyName));
    }
}
