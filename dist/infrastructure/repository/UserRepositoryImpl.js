import { User } from '../../domain/model/User.js';
// Sample in-memory implementation
export class UserRepositoryImpl {
    users = [
        new User('1', 'John Doe', 'john@example.com', new Date()),
        new User('2', 'Jane Doe', 'jane@example.com', new Date()),
    ];
    async findById(id) {
        return this.users.find(user => user.id === id) || null;
    }
    async findAll() {
        return this.users;
    }
    async save(user) {
        this.users.push(user);
    }
    async delete(id) {
        this.users = this.users.filter(user => user.id !== id);
    }
}
