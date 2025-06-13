import KnexConnection from "../../database/KnexConnections";
const TABLE_NAME = 'samplecontainer';

interface SampleContainer {
  id?: number;
  name: string;
  description?: string;
  volume_capacity: number;
  material: string;
  color: string;
  is_reusable: boolean;
  created_at?: Date;
  updated_at?: Date;
}

class SampleContainerRepository {
  private connection: Promise<any>;
  constructor(tenantId: number) {
    this.connection = KnexConnection(tenantId);
  }

  async create(containerData: SampleContainer): Promise<number> {
    const conn = await this.connection;
    const result = await conn(TABLE_NAME).insert(containerData);
    return result[0];
  }

  async findAll(limit: number = 10, offset: number = 0): Promise<SampleContainer[]> {
    const conn = await this.connection;
    return await conn(TABLE_NAME)
      .select('*')
      .limit(limit)
      .offset(offset);
  }

  async findById(id: number): Promise<SampleContainer | undefined> {
    const conn = await this.connection;
    return conn(TABLE_NAME).where({ id }).first();
  }

  async findByName(name: string): Promise<SampleContainer | undefined> {
    const conn = await this.connection;
    return conn(TABLE_NAME).where({ name }).first();
  }

  async update(id: number, containerData: Partial<SampleContainer>): Promise<number> {
    const conn = await this.connection;
    return conn(TABLE_NAME)
      .where({ id })
      .update({ ...containerData, updated_at: conn.fn.now() });
  }

  async delete(id: number): Promise<number> {
    const conn = await this.connection;
    return conn(TABLE_NAME).where({ id }).del();
  }

  async findReusableContainers(): Promise<SampleContainer[]> {
    const conn = await this.connection;
    return conn(TABLE_NAME).where({ is_reusable: true });
  }

  async findByMaterial(material: string): Promise<SampleContainer[]> {
    const conn = await this.connection;
    return conn(TABLE_NAME).where({ material });
  }
}

export default SampleContainerRepository;