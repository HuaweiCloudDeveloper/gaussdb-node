// ESM wrapper for gaussdb
import gaussdb from '../lib/index.js'

// Re-export all the properties
export const Client = gaussdb.Client
export const Pool = gaussdb.Pool
export const Connection = gaussdb.Connection
export const types = gaussdb.types
export const gaussdbTypes = gaussdb.gaussdbTypes
export const Query = gaussdb.Query
export const DatabaseError = gaussdb.DatabaseError
export const escapeIdentifier = gaussdb.escapeIdentifier
export const escapeLiteral = gaussdb.escapeLiteral
export const Result = gaussdb.Result
export const TypeOverrides = gaussdb.TypeOverrides
export const LogicalReplicationService = gaussdb.LogicalReplicationService
export const MppdbDecodingPlugin = gaussdb.MppdbDecodingPlugin

// Also export the defaults
export const defaults = gaussdb.defaults

// Re-export the default
export default gaussdb
