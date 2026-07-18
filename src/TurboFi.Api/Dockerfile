FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/TurboFi.Api/TurboFi.Api.csproj", "src/TurboFi.Api/"]
RUN dotnet restore "src/TurboFi.Api/TurboFi.Api.csproj"
COPY . .
RUN dotnet publish "src/TurboFi.Api/TurboFi.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TurboFi.Api.dll"]
