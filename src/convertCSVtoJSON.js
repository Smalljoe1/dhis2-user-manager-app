import Papa from 'papaparse';

export const convertCSVtoJSON = (csvData) => {
  try {
    const result = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    if (!result.data.length) throw new Error('No data rows found');
    return result.data.map(row => ({
      firstName: row.firstName || '',
      surname: row.surname || '',
      username: Number(row.username) || row.username,
      password: row.password || '',
      userRoles: row.userRoles ? JSON.parse(row.userRoles) : [],
      organisationUnits: row.organisationUnits ? JSON.parse(row.organisationUnits) : [],
      dataViewOrganisationUnits: row.dataViewOrganisationUnits ? JSON.parse(row.dataViewOrganisationUnits) : [],
      teiSearchOrganisationUnits: row.teiSearchOrganisationUnits ? JSON.parse(row.teiSearchOrganisationUnits) : [],
      userGroups: row.userGroups ? JSON.parse(row.userGroups) : [],
    }));
  } catch (error) {
    console.error('CSV parsing failed:', error);
    return null;
  }
};