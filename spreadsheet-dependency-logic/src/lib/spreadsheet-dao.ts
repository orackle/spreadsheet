import { Result, okResult, errResult } from 'cs544-js-utils';

import * as mongo from 'mongodb';

/** All that this DAO should do is maintain a persistent map from
 *  [spreadsheetName, cellId] to an expression string.
 *
 *  Most routines return an errResult with code set to 'DB' if
 *  a database error occurs.
 */

/** return a DAO for spreadsheet ssName at URL mongodbUrl */
export async function
makeSpreadsheetDao(mongodbUrl: string, ssName: string)
  : Promise<Result<SpreadsheetDao>> 
{
  return SpreadsheetDao.make(mongodbUrl, ssName);
}

export class SpreadsheetDao {

  //TODO: add properties as necessary
  private client: mongo.MongoClient;
  private ssName: string;
  //factory method
  static async make(dbUrl: string, ssName: string)
    : Promise<Result<SpreadsheetDao>>
  {

    try{
      const client = new mongo.MongoClient(dbUrl);
      await client.connect();
      const dao = new SpreadsheetDao(client, ssName);
      return okResult(dao);
    } catch (e) {
      return errResult('DB','DB');
    }
  }

  constructor(client: mongo.MongoClient, ssName: string) {
    this.client = client;
    this.ssName = ssName;
  }
  /** Release all resources held by persistent spreadsheet.
   *  Specifically, close any database connections.
   */
  async close() : Promise<Result<undefined>> {
    //TODO

    try {
      await this.client.close();
      return okResult(undefined);
    } catch (error) {
      return errResult('DB', error.message);
    }
  }

  /** return name of this spreadsheet */
  getSpreadsheetName() : string {
    return this.ssName;
  }

  /** Set cell with id cellId to string expr. */
  async setCellExpr(cellId: string, expr: string)
    : Promise<Result<undefined>>
  {
    try {
      await this.client.db(this.ssName).collection('cells').insertOne({ cellId: cellId, expr: expr });
      return okResult(undefined);
    } catch (e) {
      return errResult('DB', 'DB');
    }
  }

  /** Return expr for cell cellId; return '' for an empty/unknown cell.
   */
  async query(cellId: string) : Promise<Result<string>> {
    try {
      const result = await this.client.db(this.ssName).collection('cells').findOne({ cellId: cellId });
      if (result == null) {
        return okResult('');
      } else {
        return okResult(result.expr);
      }
    } catch (e) {
      return errResult('DB', 'DB');
    }
  }

  /** Clear contents of this spreadsheet */
  async clear() : Promise<Result<undefined>> {
    try {
      await this.client.db(this.ssName).dropDatabase();
      return okResult(undefined);
    } catch (error) {
      return errResult('DB', error.message);
    }
  }

  /** Remove all info for cellId from this spreadsheet. */
  async remove(cellId: string) : Promise<Result<undefined>> {
    try {
      await this.client.db(this.ssName).collection('cells').deleteOne({ cellId: cellId });
      return okResult(undefined);
    } catch (e) {
      return errResult('DB', 'DB');
    }
  }

  /** Return array of [ cellId, expr ] pairs for all cells in this
   *  spreadsheet
   */
  async getData() : Promise<Result<[string, string][]>> {
    try {
      const result = await this.client.db(this.ssName).collection('cells').find().toArray();
      const data: [string, string][] = [];
      for (let i = 0; i < result.length; i++) {
        await data.push([result[i].cellId, result[i].expr]);
      }

      return okResult(data);
    } catch (e) {
      return errResult('DB', 'DB');
    }
  }

}




