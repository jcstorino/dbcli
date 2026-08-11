using System.Text.Json;
using Microsoft.Data.SqlClient;

var payload = await Console.In.ReadToEndAsync();

if (string.IsNullOrWhiteSpace(payload))
{
    Console.Error.WriteLine("Missing request payload.");
    Environment.Exit(1);
}

var request = JsonSerializer.Deserialize<SqlClientRequest>(payload, new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true
});

if (request is null || request.Connection is null || string.IsNullOrWhiteSpace(request.Sql))
{
    Console.Error.WriteLine("Invalid request payload.");
    Environment.Exit(1);
}

var builder = new SqlConnectionStringBuilder
{
    DataSource = $"{request.Connection.Server},{request.Connection.Port ?? 1433}",
    InitialCatalog = request.Connection.Database,
    IntegratedSecurity = true,
    Pooling = false,
    ConnectTimeout = 30,
    Encrypt = request.Connection.Encrypt ?? false,
    TrustServerCertificate = request.Connection.TrustServerCertificate ?? true,
    ApplicationName = "dbcli"
};

using var connection = new SqlConnection(builder.ConnectionString);
connection.Open();

using var command = new SqlCommand(request.Sql, connection)
{
    CommandTimeout = 0
};

using var reader = command.ExecuteReader();

var rows = new List<Dictionary<string, object?>>();

while (reader.Read())
{
    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

    for (var i = 0; i < reader.FieldCount; i++)
    {
        row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
    }

    rows.Add(row);
}

var response = new SqlClientResponse(rows.Count, rows);
Console.Write(JsonSerializer.Serialize(response, new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
}));

internal sealed record SqlClientRequest(SqlClientConnection Connection, string Sql);

internal sealed record SqlClientConnection(
    string Server,
    int? Port,
    string Database,
    bool? Encrypt,
    bool? TrustServerCertificate
);

internal sealed record SqlClientResponse(
    int RowCount,
    List<Dictionary<string, object?>> Rows
);
