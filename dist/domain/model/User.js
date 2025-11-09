export class User {
    id;
    name;
    email;
    createdAt;
    constructor(id, name, email, createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.createdAt = createdAt;
    }
    getDisplayName() {
        return `${this.name} (${this.email})`;
    }
}
