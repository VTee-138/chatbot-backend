class countryDBServices{
        async getAllCountries(){
            return await prisma.country.findMany()
        }
        async getCountryCodeByName(name){
            try {
                return await prisma.country.findFirst({where: {name}})
            } catch (error) {
                throw error
            }
        }
}
module.exports = new countryDBServices()