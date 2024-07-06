import {default as parse, CellRef, Ast } from './expr-parser.js';

import { Result, okResult, errResult } from 'cs544-js-utils';

//factory method
export default async function makeSpreadsheet(name: string) :
  Promise<Result<Spreadsheet>>
{
  return okResult(new Spreadsheet(name));
}

type Updates = { [cellId: string]: number };


export class CellInfo {
  id: string;
  expr: string;
  ast: Ast ;
  value: number;
  dependents: Set<string>;
  constructor(id: string, expr: string) {
    this.id = id;
    this.expr = expr;
    const result = parse(expr);
    // Caching of the AST corresponding to the expr.
    if (result.isOk) {
      this.ast = result.val;
    }
    // else initialize ast with Num AST
    // Caching of the value of the cell.

    this.value = 0;

    // Set of cells that depend on this cell.
    this.dependents = new Set();
  }
}
export class Spreadsheet {

  readonly name: string;
  readonly cells: { [cellId: string]: CellInfo } = { };
  //TODO: add other instance variable declarations  
  constructor(name: string) {
    this.name = name;
    //TODO: add initializations for other instance variables
    // add initializations
    this.cells = {};
  }

  /** Set cell with id cellId to result of evaluating formula
   *  specified by the string expr.  Update all cells which are
   *  directly or indirectly dependent on the base cell cellId.
   *  Return an object mapping the id's of all updated cells to
   *  their updated values.  
   *
   *  Errors must be reported by returning an error Result having its
   *  code options property set to `SYNTAX` for a syntax error and
   *  `CIRCULAR_REF` for a circular reference and message property set
   *  to a suitable error message.
   */


  async eval(cellId: string, expr: string): Promise<Result<Updates>> {
    try {
      const result = parse(expr);
      const updates: Updates = {};
  
      if (!result.isOk) {
        return result;
      }
  
  
      const ast = result.val;
  
      // Check for circular references
      const directDependents = this.extractDependents(expr);
      if (directDependents.includes(cellId)) {
        return errResult('circular ref involving '+cellId, 'CIRCULAR_REF');
      }
  
      const indirectDependents = this.extractIndirectDependents(expr);
      if (indirectDependents.includes(cellId)) {
        return errResult('circular ref involving '+cellId, 'CIRCULAR_REF');
      }
  
      // Update the cell with the new expression and AST
      if (!this.cells[cellId]) {
        this.cells[cellId] = new CellInfo(cellId, expr);
        this.cells[cellId].value = 0;
        updates[cellId] = 0;
      } else {
        const oldDependents = this.extractDependents(this.cells[cellId].expr);
        oldDependents.forEach((dependent) => {
          const cell = this.cells[dependent];
          if (cell) {
            cell.dependents.delete(cellId);
          }
        });
      }
  
      this.cells[cellId].expr = expr;
      this.cells[cellId].ast = ast;
  
     
  
      const visited = new Set<string>();
      const evaluating = new Set<string>();


       // evaluate the cell
       const resultVal = this.evaluate(ast, CellRef.parseRef(cellId));
       this.cells[cellId].value = resultVal;
       if (resultVal) {
         updates[cellId] = resultVal;
       }
  
       const dfs = async (cellId: string) => {
        if (evaluating.has(cellId)) {
          return; // Stop the evaluation if a cyclic dependency is detected
        }
  
        evaluating.add(cellId);
        // Evaluate the cell and update its dependents according to the expression in the cell
  
        const cell = this.cells[cellId];
  
        if (!cell) {
          return;
        }
  
        const dependentPromises = Array.from(cell.dependents).map(async (dependent) => {
          const dependentCell = this.cells[dependent];
          if (dependentCell) {
            const result = await this.eval(dependent, dependentCell.expr);
            if (result.isOk) {
              updates[dependent] = result.val[dependent];
            }
          }
        });
  
        await Promise.all(dependentPromises);
  
        visited.add(cellId);
        evaluating.delete(cellId);
      };
  
     await dfs(cellId);
  
      // using the new expression add this cell to the dependents of the cells it depends on
      const newDependents = this.extractDependents(expr);
      newDependents.forEach((dependent) => {
        const cell = this.cells[dependent];
        if (cell) {
          cell.dependents.add(cellId);
        }
      });
  
      return okResult(updates);
    } catch (error) {
      return errResult('error', error.message);
    }
  }
  
  
  
  


extractIndirectDependents(expr: string) {
  const indirectDependents: string[] = [];
  const cellRefRegex = /[a-zA-Z]+\d+/g; // Regular expression to match cell references (e.g., A1, B2, etc.)
  let match;

  while ((match = cellRefRegex.exec(expr)) !== null) {
    const cellRef = match[0];
    const cell = this.cells[cellRef];
    if (cell) {
      indirectDependents.push(...this.extractDependents(cell.expr));
    }
  }

  return indirectDependents;


}
  
  private extractDependents(expr: string): string[] {
    const dependents: string[] = [];
    const cellRefRegex = /[a-zA-Z]+\d+/g; // Regular expression to match cell references (e.g., A1, B2, etc.)
    let match;
  
    while ((match = cellRefRegex.exec(expr)) !== null) {
      const cellRef = match[0];
      dependents.push(cellRef);
    }
  
    return dependents;
  }
  
  evaluate(ast: Ast, baseCellRef: CellRef): number {
    switch (ast.kind) {
      case 'num':
        return ast.value;
        case 'app':
        if (ast.kids.length === 2) {
        if (ast.kids[0].kind === 'ref' && ast.kids[1].kind === 'ref') {
          const cell1 = (ast.kids[0].value.toText());
          const cell2 = (ast.kids[1].value.toText());
          if (!this.cells[cell1]) {
            this.cells[cell1] = new CellInfo(cell1, '0');
            this.cells[cell1].value = 0;
          }
          if (!this.cells[cell2]) {
            this.cells[cell2] = new CellInfo(cell2, '0');
            this.cells[cell2].value = 0;
          }

          const cellInfo1 = this.cells[cell1];
          const cellInfo2 = this.cells[cell2];
          if (cellInfo1 && cellInfo2) {
            const fn = FNS[ast.fn];
            if (fn) {
              return fn(cellInfo1.value, cellInfo2.value);
            }
          }
        }
        const fn = FNS[ast.fn];
        if (fn) {
          return fn(this.evaluate(ast.kids[0], baseCellRef), this.evaluate(ast.kids[1], baseCellRef));
        }
        throw new Error('bad function');
      } else if (ast.kids.length !== 2) {
        const args = ast.kids.map((kid) => this.evaluate(kid, baseCellRef));
        const fn = FNS[ast.fn];
        if (typeof fn === 'function') {
          return fn.apply(null, args);
        } else {
          throw new Error('bad function');
        }
      }
          
      case 'ref':
        const astRef = ast.toText(baseCellRef);
        const cellRefResult = CellRef.parse(astRef, baseCellRef);
        if (cellRefResult.isOk) {
          const cellRef = cellRefResult.val;
          const cellId = cellRef.toText(cellRef);
          const cellInfo = this.cells[cellId];
          if (cellInfo) {
            if (cellInfo.value !== undefined) {
              return cellInfo.value;
            } else {
              // Evaluate the cell's AST recursively
              return this.evaluate(cellInfo.ast!, cellRef);
            }
          } else {
            return 0; // Cell not found, return 0
          }
        } else {
          throw new Error('Invalid cell');
        }
      default:
        return 0;
    }
  }
  
  

}

//TODO: add additional classes and/or functions


const FNS = {
  '+': (a:number, b:number) : number => a + b,
  '-': (a:number, b?:number) : number => b === undefined ? -a : a - b,
  '*': (a:number, b:number) : number => a * b,
  '/': (a:number, b:number) : number => a / b,
  min: (a:number, b:number) : number => Math.min(a, b),
  max: (a:number, b:number) : number => Math.max(a, b),
}
