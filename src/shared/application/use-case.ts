/**
 * Contrato comum de um caso de uso. Depender desta interface (em vez da classe
 * concreta) permite envolvê-lo em decorators — como o Unit of Work — de forma
 * transparente para quem o consome (controllers, outros use cases).
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}
