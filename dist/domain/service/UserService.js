import { User } from '../model/User.js';
export class UserService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async getUserById(id) {
        return this.userRepository.findById(id);
    }
    async getAllUsers() {
        return this.userRepository.findAll();
    }
    async createUser(user) {
        // Domain logic: validate user, etc.
        await this.userRepository.save(user);
    }
}
